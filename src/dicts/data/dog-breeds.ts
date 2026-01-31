export type DogBreedDictItem = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases?: string[];
};

export const DOG_BREEDS: DogBreedDictItem[] = [
  { id: 'unknown', nameZh: '未知', nameEn: 'Unknown', aliases: ['UNKNOWN'] },
  { id: 'other', nameZh: '其他', nameEn: 'Other' },
  { id: 'bichon_frise', nameZh: '比熊', nameEn: 'Bichon Frise', aliases: ['Bichon'] },
  { id: 'poodle_toy', nameZh: '泰迪', nameEn: 'Toy Poodle', aliases: ['Poodle', '贵宾'] },
  { id: 'golden_retriever', nameZh: '金毛', nameEn: 'Golden Retriever', aliases: ['Golden'] },
  { id: 'labrador_retriever', nameZh: '拉布拉多', nameEn: 'Labrador Retriever', aliases: ['Labrador'] },
  { id: 'siberian_husky', nameZh: '哈士奇', nameEn: 'Siberian Husky', aliases: ['Husky'] },
  { id: 'shiba_inu', nameZh: '柴犬', nameEn: 'Shiba Inu', aliases: ['Shiba'] },
  { id: 'border_collie', nameZh: '边境牧羊犬', nameEn: 'Border Collie', aliases: ['Border Collie', '边牧'] },
  { id: 'welsh_corgi', nameZh: '柯基', nameEn: 'Welsh Corgi', aliases: ['Corgi'] },
  { id: 'pomeranian', nameZh: '博美', nameEn: 'Pomeranian' },
  { id: 'chihuahua', nameZh: '吉娃娃', nameEn: 'Chihuahua' },
];

