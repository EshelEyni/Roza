import { useNavigate } from "react-router-dom";

function useOnGoBack() {
  const navigate = useNavigate();

  function onGoBack() {
    navigate(-1);
  }

  return onGoBack;
}

export { useOnGoBack };
