import { FC } from "react";
import { useLoginWithToken } from "../../hooks/useLoginWithToken";
import { Main } from "../../components/Main";
import { Loader } from "../../components/Loader";

const ProfileDetails: FC = () => {
  const { loggedInUser } = useLoginWithToken();

  return (
    <Main>
      <h1></h1>
    </Main>
  );
};

export default ProfileDetails;
