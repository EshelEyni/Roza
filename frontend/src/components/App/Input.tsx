import {
  UseFormRegister,
  FieldValues,
  Path,
  UseFormTrigger,
} from "react-hook-form";

type InputProps<T extends FieldValues> = {
  register: UseFormRegister<T>;
  placeholder: string;
  name: Path<T>;
  type?: string;
  required?: boolean | string;
  trigger?: UseFormTrigger<T>;
};

export const Input = <T extends FieldValues>({
  register,
  placeholder,
  name,
  type = "text",
  trigger,
  required,
}: InputProps<T>) => {
  return (
    <input
      id={name}
      type={type}
      className="w-full max-w-96 rounded border border-app-300 p-2"
      {...register(name, { required })}
      placeholder={placeholder}
      onBlur={() => required && trigger && trigger(name)}
      autoComplete="off"
    />
  );
};
