;redcode
;name Dervish
;Tournament: ICWST'90
;Standard: CWS'88
;author D.Bofinger
;1990
;assert 1
;
;             A trivial modification of dwarf, that
;               can beat most of the ICWST'87 and
;               ICWST'88 programs.
;
        dat     #12,    #12
start   mov     -1,     @-1
        add     #548,   -2
        jmp     -2
        end     start
