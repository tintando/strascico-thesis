# Sapienza Thesis Formatting Requirements

Source: https://www.uniroma1.it/it/pagina/impaginazione-della-tesi-e-logo
LaTeX class: https://ctan.org/pkg/sapthesis (v5.1, July 2022)

---

## LaTeX Class

Use `sapthesis.cls`. Install via TeX Live/MiKTeX or place the `.cls` file in the thesis directory.

```latex
\documentclass[binding=0.6cm, english]{sapthesis}
```

Obtain the class:
```
tlmgr install sapthesis
```
or download from https://ctan.org/pkg/sapthesis.

---

## Typography

| Element          | Specification                          |
|------------------|----------------------------------------|
| Body font        | Palatino Linotype, 10 or 12 pt         |
| Heading font     | Arial                                  |
| Heading sizes    | H1: 16pt, H2: 14pt, H3: 12pt          |
| Footnote size    | 9pt (italic acceptable)                |
| Line spacing     | Single or 1.5                          |
| Text alignment   | Left-aligned (ragged right) preferred; justified also accepted |

---

## Page Layout

| Setting       | Value                                 |
|---------------|---------------------------------------|
| Paper size    | A4 (default) or A5                    |
| Binding       | `binding=0.6cm` (adjust as needed)    |
| Printing      | Two-sided (default)                   |

---

## Required Preamble Commands

### Mandatory

```latex
\title{...}
\author{...}
\IDnumber{...}          % Matricola number
\course{...}            % Official course name
\courseorganizer{...}   % Faculty / School name
\AcademicYear{.../...}
\advisor{Prof. ...}
\authoremail{...}
\copyyear{YYYY}
```

### Optional

```latex
\subtitle{...}
\coadvisor{Dr. ...}
\thesistype{Master thesis}   % or "PhD thesis", "Bachelor thesis"
\examdate{...}
\examiner{...}
\dedication{...}
\versiondate{...}
\extrainfo{...}
```

For **PhD theses**, also add:
```latex
\cycle{XXXVII}    % Roman numeral cycle number
```

---

## Document Structure

```latex
\begin{document}

\frontmatter
\maketitle
\dedication{...}          % optional
\begin{abstract} ... \end{abstract}
\begin{acknowledgments} ... \end{acknowledgments}   % optional
\tableofcontents

\mainmatter
\chapter{Introduction}
% ... chapters ...

\backmatter
\bibliographystyle{sapthesis}
\bibliography{bibliography/references}

\end{document}
```

---

## Logo Usage

- Use the **official Sapienza logo** on the cover/frontispiece (included in `sapienzalogo.pdf` within the sapthesis package, automatically placed by `\maketitle`).
- Never separate the logo symbol from the "Sapienza Università di Roma" text.
- Use the **positive variant** on light backgrounds.
- Use **vector (CMYK)** for print; **PNG (RGB)** for digital.
- All text must be aligned to the "S" in "Sapienza".

---

## Cover and Frontispiece

- The frontispiece is generated automatically by `\maketitle`.
- All elements in the frontispiece template must be retained; do not remove any.
- The cover may be personalised (colour, material) when ordering physical printing.

---

## Compilation

```bash
pdflatex thesis
bibtex thesis
pdflatex thesis
pdflatex thesis
```

Or simply:
```bash
make
```

---

## Submission

- Submit as **PDF** through the official Sapienza thesis application portal.
- Physical printing is **not mandatory**.
- Contact: settore.promozioneimmagine@uniroma1.it for branding questions.

---

## Key Rules (Do Not Violate)

1. Do not separate the Sapienza logo symbol from the university name text.
2. Do not use centered body text composition; use left-aligned or justified.
3. Align all elements to the "S" in "Sapienza" on the cover.
4. Keep all template elements on the frontispiece; do not delete any.
