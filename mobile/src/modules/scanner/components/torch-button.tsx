import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

type TorchButtonProps = {
  on: boolean;
  onToggle: () => void;
};

// Linterna de las dos camaras (QR y DNI): icono redondo de 56 dp en la
// esquina, sobre la imagen. Encendida es el circulo claro con el icono
// lleno; apagada, el oscuro translucido con el contorno.
export function TorchButton({ on, onToggle }: TorchButtonProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={on ? 'Apagar linterna' : 'Encender linterna'}
      accessibilityState={{ checked: on }}
      hitSlop={8}
      className={`absolute right-4 top-4 h-14 w-14 items-center justify-center rounded-full border active:opacity-70 ${
        on ? 'border-text-primary bg-text-primary' : 'border-text-primary/40 bg-bg-base/60'
      }`}
    >
      <Ionicons name={on ? 'flashlight' : 'flashlight-outline'} size={26} color={on ? '#09090b' : '#fafafa'} />
    </Pressable>
  );
}
