UPDATE inspection_questions 
SET key = 'Q4' 
WHERE key = 'precious_metal_polish_scale';

UPDATE inspection_rules 
SET target_question = 'Q4' 
WHERE target_question = 'precious_metal_polish_scale';