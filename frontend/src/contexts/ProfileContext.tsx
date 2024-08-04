import { createContext, useContext, useState } from "react";
import { Tab } from "../../../shared/types/system";

type ProfileContextType = {
  tab: Tab;
  setTab: React.Dispatch<React.SetStateAction<Tab>>;
};

type ProfileProviderProps = {
  children: React.ReactNode;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

function ProfileProvider({ children }: ProfileProviderProps) {
  const [tab, setTab] = useState<Tab>("display");

  const value = { tab, setTab };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context)
    throw new Error("useProfile must be used within a ProfileProvider");

  return context;
};

export { ProfileProvider, useProfile };
