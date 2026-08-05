MAIN   = thesis
BUILD  = build
LATEX  = pdflatex -synctex=1 -interaction=nonstopmode -file-line-error -output-directory=$(BUILD)
BIBTEX = bibtex

.PHONY: all bib clean distclean builddir

builddir:
	@mkdir -p $(BUILD)/chapters $(BUILD)/frontmatter

all: builddir
	$(LATEX) $(MAIN)
	$(LATEX) $(MAIN)
	@cp $(BUILD)/$(MAIN).pdf $(MAIN).pdf
	@cp $(BUILD)/$(MAIN).synctex.gz $(MAIN).synctex.gz 2>/dev/null || true

bib: builddir
	$(LATEX) $(MAIN)
	cd $(BUILD) && BIBINPUTS=..: BSTINPUTS=..: TEXMFOUTPUT=. $(BIBTEX) $(MAIN)
	$(LATEX) $(MAIN)
	$(LATEX) $(MAIN)
	@cp $(BUILD)/$(MAIN).pdf $(MAIN).pdf
	@cp $(BUILD)/$(MAIN).synctex.gz $(MAIN).synctex.gz 2>/dev/null || true

clean:
	rm -rf $(BUILD)

distclean: clean
	rm -f $(MAIN).pdf $(MAIN).synctex.gz
