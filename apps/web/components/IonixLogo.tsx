import Image from 'next/image';

interface IonixLogoProps {
  className?: string;
  variant?: 'dark' | 'light';
}

export function IonixLogo({ className = '', variant = 'dark' }: IonixLogoProps) {
  return (
    <Image
      src={variant === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
      alt="Ionix Partner"
      width={240}
      height={60}
      className={className}
      priority
      style={{ objectFit: 'contain' }}
    />
  );
}
