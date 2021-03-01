import { PLAYER_HEART_HEALTH } from './config';
import Image from './Image';

export interface IPlayer {
  // wsPie id
  clientId: string;
  heart_health: number;
  heart_x: number;
  heart_y: number;
  heart: Image;
}
export function create(clientId: string, heart_y: number): IPlayer {
  const heart_x = 3.5;
  const heart = new Image(
    heart_x,
    heart_y,
    0,
    // Orient heart rotation properly, account for inverted game board
    window.inverted ? -1 : 0,
    'heart.png',
  );
  return {
    clientId,
    heart_health: PLAYER_HEART_HEALTH,
    heart_x,
    heart_y,
    heart,
  };
}
