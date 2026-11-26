import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Pseudo en majuscules, comme affiché sur la matrice de la borne. */
const toPseudo = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class RegisterDto {
  @Transform(toPseudo)
  @Matches(/^[A-Z0-9]{2,8}$/, { message: 'Le pseudo fait 2 à 8 caractères, lettres et chiffres uniquement.' })
  pseudo: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe fait au moins 8 caractères.' })
  @MaxLength(72)
  password: string;

  @IsBoolean()
  @Equals(true, { message: "Il faut accepter que ton pseudo et tes scores soient visibles." })
  consent: boolean;
}

export class LoginDto {
  @Transform(toPseudo)
  @IsString()
  pseudo: string;

  @IsString()
  password: string;
}
