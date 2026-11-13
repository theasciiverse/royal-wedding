# The Royal Wedding in the terminal, as one native program: the browser game's own
# scripts, unchanged, joined with rotty (asciiverse/rotty: the browser as
# far as rot.js games need it, drawn in the terminal) by build.py into one
# module, compiled to bytecode by QuickJS-ng's qjsc into a C program.
# Run from the repo root:
#
#   make -f asciiverse/Makefile          # out/goldfish
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

Q := asciiverse/quickjs
QSRC := $(Q)/quickjs.c $(Q)/libregexp.c $(Q)/libunicode.c $(Q)/dtoa.c $(Q)/quickjs-libc.c
QDEFS := -D_GNU_SOURCE -DCONFIG_VERSION=\"0.17.0\"
B := build
MOD := $(subst -,_,$(NAME))

all: out/$(NAME)$(EXE)

$(B)/$(MOD).mjs: asciiverse/build.py asciiverse/game.js $(wildcard asciiverse/rotty/*.js) index.html $(wildcard js/*.js js/*/*.js js/*/*/*.js levels/*)
	python3 asciiverse/build.py $@ $(VERSION)

$(B)/qjsc: $(Q)/qjsc.c $(QSRC)
	mkdir -p $(B)
	$(HOSTCC) -O2 $(QDEFS) -o $@ $(Q)/qjsc.c $(QSRC) -lm -lpthread

$(B)/$(MOD).c: $(B)/$(MOD).mjs $(B)/qjsc
	$(B)/qjsc -e -m -N $(MOD) -o $@ $(B)/$(MOD).mjs

out/$(NAME)$(EXE): $(B)/$(MOD).c $(QSRC)
	mkdir -p out
	$(CC) $(CFLAGS) $(QDEFS) -I$(Q) $(LDFLAGS) -o $@ $(B)/$(MOD).c $(QSRC) -lm -lpthread

clean:
	rm -rf $(B) out

.PHONY: all clean
