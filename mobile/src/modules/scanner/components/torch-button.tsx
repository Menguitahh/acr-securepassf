import { Pressable, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type TorchButtonProps = {
  on: boolean;
  onToggle: () => void;
};

// Linterna de las dos camaras (QR y DNI). Icono + estado en texto para leerlo
// de lejos con el telefono en la otra mano: encendida es el boton claro con
// "Encendida", apagada el oscuro con "Linterna". 48 dp de alto.
export function TorchButton({ on, onToggle }: TorchButtonProps) {
  const color = on ? '#09090b' : '#fafafa';
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel="Linterna"
      accessibilityState={{ checked: on }}
      className={`absolute right-4 top-4 h-12 min-w-[120px] flex-row items-center justify-center gap-2 rounded-md border px-4 active:opacity-70 ${
        on ? 'border-text-primary bg-text-primary' : 'border-text-primary bg-bg-elevated/70'
      }`}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 2h10v4l-3 4v12h-4V10L7 6V2z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          fill={on ? color : 'none'}
        />
      </Svg>
      <Text className={`text-body font-semibold ${on ? 'text-bg-base' : 'text-text-primary'}`}>
        {on ? 'Encendida' : 'Linterna'}
      </Text>
    </Pressable>
  );
}
