INSERT INTO ingredients (id, name, inci_name, status, explanation, category)
VALUES
  (gen_random_uuid(), 'Isopropyl Myristate', 'ISOPROPYL MYRISTATE', 'flagged',
   'A lightweight emollient with a comedogenicity rating of 5/5. Penetrates the follicle and promotes the formation of closed comedones (hard bumps). Frequently found in serums and moisturizers marketed as non-greasy.',
   null),
  (gen_random_uuid(), 'Isopropyl Palmitate', 'ISOPROPYL PALMITATE', 'flagged',
   'A fatty acid ester similar to Isopropyl Myristate with a high comedogenicity rating. Commonly used to improve texture and spreadability but is a well-documented trigger for closed comedones on acne-prone and reactive skin.',
   null),
  (gen_random_uuid(), 'Coco-Caprylate/Caprate', 'COCO-CAPRYLATE/CAPRATE', 'flagged',
   'A coconut-derived emollient widely used in "clean beauty" formulas for its lightweight, non-greasy feel. Despite its natural origin, it can be comedogenic and trigger closed comedones, particularly on the forehead and chin.',
   null)
ON CONFLICT (name) DO NOTHING;
