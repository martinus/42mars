;redcode
;name DoubleBullet
;author Lukasz Adamowski
;assert 1

bmb     equ     trg
ste     equ     81
WHERE   equ     4009

trg     dat     #0,     #0
        dat     #0,     #0
        dat     #0,     #0
start   mov     dwarf,  dwarf+WHERE
        mov     dwarf+1,        dwarf+1+WHERE
        mov     dwarf+2,        dwarf+2+WHERE
        spl     dwarf+WHERE
        spl     dwarf+WHERE
        spl     dwarf+WHERE
        spl     4
        spl     2
dwarf   mov     $bmb,   @trg
        add     #ste,   $trg
        jmp     $-2

        end     start
