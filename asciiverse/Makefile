# The Royal Wedding in the terminal, as one native program: the browser game's own
# scripts, unchanged, joined with rotty (asciiverse/rotty: the browser as
# far as rot.js games need it, drawn in the terminal) by build.py into one
# module, compiled to bytecode by QuickJS-ng's qjsc into a C program.
# Run from the repo root:
#
#   make -f asciiverse/Makefile          # out/royal-wedding
#
# Needs python3 to build, nothing to run. CC, CFLAGS, LDFLAGS, HOSTCC, EXE
# (.exe for Windows) and VERSION can be set from outside.

NAME := royal-wedding
CC ?= cc
HOSTCC ?= cc
CFLAGS ?= -O2
LDFLAGS ?=
VERSION ?= dev
EXE ?=
# the game's own files the build reads
GAMEFILES := $(wildcard js/*.js js/*/*.js js/*/*/*.js levels/*)

Q := asciiverse/quickjs
QNAMES := quickjs libregexp libunicode dtoa quickjs-libc
QSRC := $(QNAMES:%=$(Q)/%.c)
QDEFS := -D_GNU_SOURCE -DCONFIG_VERSION=\"0.17.0\"
B := build
MOD := $(subst -,_,$(NAME))
# QuickJS-ng compiled once per file, for the build machine (qjsc) and for
# the target, so make -j builds them side by side
HOBJ := $(QNAMES:%=$(B)/host/%.o)
TOBJ := $(QNAMES:%=$(B)/target/%.o)

all: out/$(NAME)$(EXE)

$(B)/$(MOD).mjs: asciiverse/build.py asciiverse/game.js $(wildcard asciiverse/rotty/*.js) index.html $(GAMEFILES)
	python3 asciiverse/build.py $@ $(VERSION)

$(B)/host/%.o: $(Q)/%.c
	@mkdir -p $(B)/host
	$(HOSTCC) -O2 $(QDEFS) -c -o $@ $<

$(B)/target/%.o: $(Q)/%.c
	@mkdir -p $(B)/target
	$(CC) $(CFLAGS) $(QDEFS) -I$(Q) -c -o $@ $<

$(B)/qjsc: $(Q)/qjsc.c $(HOBJ)
	$(HOSTCC) -O2 $(QDEFS) -o $@ $(Q)/qjsc.c $(HOBJ) -lm -lpthread

$(B)/$(MOD).c: $(B)/$(MOD).mjs $(B)/qjsc
	$(B)/qjsc -e -m -N $(MOD) -o $@ $(B)/$(MOD).mjs

out/$(NAME)$(EXE): $(B)/$(MOD).c $(TOBJ)
	mkdir -p out
	$(CC) $(CFLAGS) $(QDEFS) -I$(Q) $(LDFLAGS) -o $@ $(B)/$(MOD).c $(TOBJ) -lm -lpthread

clean:
	rm -rf $(B) out

.PHONY: all clean
