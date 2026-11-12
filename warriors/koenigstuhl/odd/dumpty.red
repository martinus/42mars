;redcode-94x
;name Dumpty IRC5
;author Philip Thorne
;assert 1
; (CORESIZE==800) && (MAXLENGTH==20)

OFFI    EQU     123

imp:    mov.i   #1,     267

    for 5
        dat 0,0
    rof

start: mov.i    imp,        imp+OFFI
    SPL     1
    SPL     1
    SPL     1

    SPL     2
    JMP     @0,         imp+OFFI
    ADD.ab     #267,       -1
    dat     1,          1

 end start
