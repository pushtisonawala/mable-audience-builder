interface Props {
  id: string;
  message?: string;
}

/** Inline error text. Its id is referenced by the input's aria-describedby. */
export function FieldError({ id, message }: Props) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  );
}
