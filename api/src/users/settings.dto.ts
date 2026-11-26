import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SettingsDto {
  @IsOptional() @IsBoolean() alertOffline?: boolean;
  @IsOptional() @IsBoolean() alertSpeedRecord?: boolean;
  @IsOptional() @IsBoolean() alertMatchPoint?: boolean;
  @IsOptional() @IsBoolean() retroSounds?: boolean;
  /**
   * Seuil de l'alerte de vitesse, en multiple de la vitesse de départ (x1,5 à x3).
   * La balle de la borne plafonne à x3,2 (57 px/s, réglages de demo_pong) : au-delà de x3, l'alerte ne partirait jamais.
   */
  @IsOptional() @IsNumber() @Min(1.5) @Max(3) speedAlertThreshold?: number;
}
