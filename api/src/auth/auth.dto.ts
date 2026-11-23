import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{2,8}$/, { message: 'Le pseudo fait 2 à 8 caractères, lettres et chiffres uniquement.' })
  pseudo: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe fait au moins 8 caractères.' })
  @MaxLength(72)
  password: string;

  @IsBoolean()
  @Equals(true, { message: "Il faut accepter que ton pseudo et tes scores soient visibles." })
  consent: boolean;
}

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;

  @IsString()
  password: string;
}
