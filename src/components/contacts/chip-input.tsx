import * as React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { X } from "@/lib/icons";

/**
 * Free-text list input — type, submit, get a chip.
 *
 * The web says "press Enter to add each item". On a phone the return key is
 * the equivalent, but a lot of keyboards make it easy to miss, so an entry
 * still in the box is committed on blur and on submit rather than silently
 * discarded.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  accent = "#AD5100",
  accentBg = "#FFF2E0",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  accent?: string;
  accentBg?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const entry = draft.trim();
    if (!entry) return;
    // Case-insensitive dedupe — "Golf" and "golf" are the same preference.
    const exists = value.some((v) => v.toLowerCase() === entry.toLowerCase());
    if (!exists) onChange([...value, entry]);
    setDraft("");
  };

  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <View className="gap-2">
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onBlur={commit}
        placeholder={placeholder}
        placeholderTextColor="#A1A1AA"
        selectionColor="#FF8900"
        returnKeyType="done"
        blurOnSubmit={false}
        autoCapitalize="sentences"
        className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
      />

      {value.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {value.map((item, index) => (
            <Pressable
              key={`${item}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item}`}
              onPress={() => remove(index)}
              style={{ backgroundColor: accentBg }}
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
            >
              <Text
                style={{ color: accent }}
                className="font-sans-medium text-[13px]"
              >
                {item}
              </Text>
              <X size={12} color={accent} strokeWidth={2.6} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
