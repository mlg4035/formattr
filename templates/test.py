from docx import Document
doc = Document("base_template.docx")
for s in doc.styles:
    if s.type == 1:  # paragraph styles
        print(s.style_id, "|", s.name)