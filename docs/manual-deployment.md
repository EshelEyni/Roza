# Manual GitHub Actions deployment for Roza

This guide replaces opening the AWS terminal and typing the Docker restart commands each time.

The deployment path is:

**GitHub Actions → temporary AWS credentials → Systems Manager → a fixed server script → Docker Hub.**

No Python webhook, public deployment URL, GitHub-to-server SSH connection, or permanent AWS access key is needed. GitHub uses [OIDC authentication](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws); AWS executes the server operation through [Systems Manager Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command.html).

## What this first version does

- Runs only when you click **Run workflow**, use GitHub CLI, or explicitly request deployment through an authenticated tool.
- Does not deploy on a push or merge to main.
- Redeploys the existing **esheleyni/roza:latest** image from Docker Hub. It does not build or push an image.
- Keeps the existing production dotenv file on the server.
- Pulls the image before stopping Roza, then starts the downloaded image by its local image ID.
- Uses container name **roza**, restart policy **unless-stopped**, and host port **3040** mapped to container port **3030**.
- Binds port 3040 to localhost because your existing nginx proxies to localhost:3040.
- Keeps the old container temporarily and attempts to restore it if startup fails.
- Allows only one deployment at a time.

There will still be a short interruption while replacing the single container. The startup check confirms an HTTP response from the app; it is not a full database or Reader functional test.

**Important:** the main branch selected in GitHub identifies the workflow being run. The application version comes from Docker Hub's latest tag, not automatically from the latest Git commit. Push the intended image first.

## 1. Put the deployment files in GitHub

These files are supplied together:

| File | Purpose |
| --- | --- |
| .github/workflows/deploy-roza.yml | Manual GitHub Actions workflow |
| scripts/deploy/roza-redeploy.sh | Fixed server-side deployment script |
| scripts/deploy/ssm-document.json | AWS command document with no user-supplied commands |
| scripts/deploy/github-role-trust.json | GitHub-to-AWS trust policy template |
| scripts/deploy/github-role-policy.json | Narrow deployment permission template |

Merge these files into main using your normal Git workflow. A manually triggered workflow must exist on the default branch before GitHub displays its Run workflow button. Adding the file does not deploy anything.

The workflow and server script have been prepared locally; the AWS resources described below must be configured before the first deployment.

## 2. Record your AWS instance details

In AWS Console → EC2 → Instances, select the server already running Roza. Record:

- **AWS account ID:** the 12-digit account number, available from the account menu.
- **AWS region:** the region code for this instance, for example eu-west-1.
- **Instance ID:** starts with i-.

Use the same account, region, and instance throughout this guide. Replace YOUR_ACCOUNT_ID, YOUR_REGION, and YOUR_INSTANCE_ID in the policy templates with these real values. None of these identifiers are passwords.

## 3. Enable AWS Systems Manager on the EC2 instance

GitHub will send an authenticated AWS command instead of connecting to an exposed SSH endpoint.

1. In IAM → Roles, use the instance's existing EC2 role, or create a role whose trusted service is **EC2**.
2. Attach the AWS-managed **AmazonSSMManagedInstanceCore** policy to that instance role. Preserve its existing policies.
3. In EC2 → your instance → Actions → Security → Modify IAM role, attach that role if necessary. Do not replace a role that already grants the app required permissions; add the SSM policy to it instead.
4. Confirm that SSM Agent is installed and running. AWS Ubuntu images often include it. In the AWS server terminal, you can check both common installation methods:

```bash
sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service
sudo systemctl status amazon-ssm-agent.service
```

One service name may be absent; that alone is not a problem. Follow AWS's [Ubuntu SSM Agent instructions](https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install-ubuntu.html) if neither installation exists.

5. In AWS Systems Manager, check that this instance appears as a managed node and is **Online**. Use the same region as EC2.
6. The instance needs outbound HTTPS access to Systems Manager and its messaging endpoints, and access to Docker Hub for image pulls. GitHub does not require an inbound SSH rule. Keep your existing administrator access.

**Stop here if the node is not Online.** Deployments cannot work until Systems Manager can reach the instance.

The EC2 instance role and the GitHub role created later are two different roles.

## 4. Install the fixed deployment script on the server

Run the following in your existing AWS server terminal, after the files are available on main:

```bash
curl --fail --show-error --location \
  https://raw.githubusercontent.com/EshelEyni/Roza/main/scripts/deploy/roza-redeploy.sh \
  --output /tmp/roza-redeploy.sh

less /tmp/roza-redeploy.sh
```

Press q to leave less after reading the script. Then install it:

```bash
sudo install -o root -g root -m 0755 /tmp/roza-redeploy.sh /usr/local/sbin/roza-redeploy
sudo bash -n /usr/local/sbin/roza-redeploy
```

The script must remain root-owned and must not be writable by the app or ordinary deployment callers.

Confirm the absolute path of your existing dotenv file, without printing its contents:

```bash
realpath ~/roza/dotenv
```

Create the deployment configuration:

```bash
sudo nano /etc/roza-deploy.conf
```

Add this line, replacing the example path with the exact path reported by realpath:

```bash
ROZA_ENV_FILE=/home/ubuntu/roza/dotenv
```

Save with Ctrl+O, Enter, then exit with Ctrl+X.

```bash
sudo chown root:root /etc/roza-deploy.conf
sudo chmod 600 /etc/roza-deploy.conf
command -v docker curl flock
sudo docker container inspect roza --format '{{.State.Running}}'
```

All three tools must be installed. The final command should show true for your existing running container.

If the Docker Hub repository is private, make sure root can pull it using a Docker Hub token with read access:

```bash
sudo docker login --username esheleyni
```

Enter the token at the prompt. These Docker credentials stay on the server. A public image does not require this login.

**Do not run the deployment script just to install it:** running it actually replaces the production container.

## 5. Create the fixed Systems Manager command document

In AWS Console → Systems Manager → Documents:

1. Choose **Create document**.
2. Name it exactly **Roza-Redeploy**.
3. Choose document type **Command** and JSON content.
4. Paste the contents of scripts/deploy/ssm-document.json.
5. Create the document in the same region as the instance.

The document runs only:

```bash
exec /usr/local/sbin/roza-redeploy
```

It accepts no arbitrary shell-command parameter. The GitHub role will be allowed to execute only this document on the one Roza instance.

The workflow explicitly selects document version **1**. If you later replace the document with a new version, deliberately update and review the workflow's version too.

## 6. Allow GitHub to authenticate to AWS

In AWS Console → IAM → Identity providers:

1. Add an **OpenID Connect** provider if this provider does not already exist.
2. Provider URL: **https://token.actions.githubusercontent.com**
3. Audience: **sts.amazonaws.com**

In IAM → Roles, create **RozaGitHubDeploy** with a custom trust policy. Use scripts/deploy/github-role-trust.json, replacing YOUR_ACCOUNT_ID.

The trust policy permits this repository's main branch:

```text
repo:EshelEyni/Roza:ref:refs/heads/main
```

This is the standard subject format for the existing Roza repository. If you have explicitly customized GitHub's OIDC subject format, match your exact subject instead; do not replace it with a wildcard.

Add an inline permissions policy to that role using scripts/deploy/github-role-policy.json. Replace all account, region, and instance placeholders.

The policy grants:

- SendCommand for **Roza-Redeploy** and your single EC2 instance.
- GetCommandInvocation so the workflow can wait for and display the result. AWS does not support scoping this read operation to one command through a resource ARN, so that statement uses Resource "*".

It does not grant general shell-command documents, document editing, EC2 administration, or IAM administration.

Copy the new role ARN, such as:

```text
arn:aws:iam::123456789012:role/RozaGitHubDeploy
```

The supplied workflow has no GitHub environment declaration. Adding one changes the OIDC subject and requires updating the trust policy. Restrict repository write access and protect main: people who can change trusted workflows on main are trusted deployment administrators.

## 7. Add GitHub repository variables

Open **EshelEyni/Roza → Settings → Secrets and variables → Actions → Variables**.

Create these **repository variables**:

| Name | Value |
| --- | --- |
| AWS_REGION | Your EC2 region code |
| AWS_ROLE_ARN | The RozaGitHubDeploy role ARN |
| ROZA_INSTANCE_ID | Your Roza EC2 instance ID |

No AWS access-key secret, SSH private key, dotenv contents, or Docker Hub push token is required in GitHub for this redeploy-only workflow. The values above are identifiers, not authentication secrets.

## 8. Build and push the release image

Keep using these local commands when you want to publish a new image:

```powershell
docker build -t roza .
docker tag roza esheleyni/roza:latest
docker push esheleyni/roza:latest
```

Wait for each command to succeed before proceeding. A code push to main does not publish a Docker image in this first version.

## 9. Deploy manually

On GitHub:

1. Open **EshelEyni/Roza → Actions → Deploy Roza**.
2. Click **Run workflow**.
3. Select branch **main**.
4. Click the final **Run workflow** button.
5. Open the run and read the deployment log.

This step really redeploys production. The workflow uses short-lived AWS credentials, sends the fixed command, and waits for its result. The server log records the actual pulled image ID.

You can also use an authenticated GitHub CLI:

```powershell
gh workflow run deploy-roza.yml --repo EshelEyni/Roza --ref main
gh run watch --repo EshelEyni/Roza
```

Choose the appropriate run when prompted. Once authenticated GitHub access is configured here, an explicit "deploy Roza" request can trigger the same manual workflow.

Normal pushes and merges into main will not trigger this workflow. GitHub documents manual triggers [here](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

## What happens if deployment fails?

- **Image pull fails:** the old container stays running.
- **New container fails its HTTP startup check:** the script attempts to remove the replacement, restore the old container's name and configuration, and start it again. The workflow still reports failure.
- **A deployment is interrupted:** inspect the server before retrying. An existing roza-previous container makes the next deployment stop safely rather than delete the backup.
- **You cancel the GitHub run:** an already-dispatched Systems Manager command can keep running. Check Systems Manager → Run Command for its actual result before starting another deployment.

The automatic rollback is a best-effort recovery for script failures, not a guarantee against server outages or forced process termination.

Useful server commands:

```bash
sudo docker ps -a --filter name=roza
sudo docker logs --tail 80 roza
```

Inspect logs locally; avoid sharing environment values or credentials.

## Troubleshooting setup

| Symptom | Check |
| --- | --- |
| No Run workflow button | The workflow must be merged into main and Actions must be enabled. |
| Run on another branch is skipped | The workflow and AWS trust both permit main only. |
| AccessDenied while assuming the AWS role | Check the account ID, provider, audience, exact repository/branch subject, and AWS_ROLE_ARN. |
| InvalidInstanceId or command never arrives | Check region, instance ID, instance profile, SSM Agent, outbound access, and managed-node Online status. |
| AccessDenied on SendCommand | Check the custom document ARN and instance ARN in the GitHub role's inline policy. |
| Docker pull denied | Check root's Docker Hub login and image visibility on the server. |
| Dotenv error | Correct the absolute ROZA_ENV_FILE path in /etc/roza-deploy.conf. |
| roza-previous already exists | Inspect both containers; recover the old one or remove only a confirmed obsolete stopped backup. |
| Script permission or interpreter error | Check root ownership, executable mode, and Linux LF line endings. Reinstall the script from the repository file. |

The production nginx configuration stays as configured, including the **client_max_body_size 25m** upload setting. This workflow restarts the app container, not nginx.

## Optional next step

After the redeploy-only version works, add a separate manual build-and-deploy workflow if you want GitHub to build and push the image too. Using a published image digest as the deployment input would also let you select an exact release instead of whichever image has the latest tag at deployment time.
