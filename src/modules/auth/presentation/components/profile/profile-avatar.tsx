import { Avatar, AvatarFallback, AvatarImage } from '@components/ui/avatar';

/** The photo is decorative beside the visible account name; a failed image falls back to initials. */
export function ProfileAvatar({
  name,
  image,
  className,
}: {
  readonly name: string;
  readonly image: string | null;
  readonly className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  return (
    <Avatar {...(className === undefined ? {} : { className })} aria-hidden="true">
      {image !== null && <AvatarImage src={image} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
