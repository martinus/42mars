;redcode-94x
;name dclear
;author Will 'Varfar'
;strategy clear
;assert 1
; CORESIZE==800

        org     prepare

gate    dat     0,      MINDISTANCE
        dat     20,     0
        for     8
        dat     0,      0
        rof

prepare add.a   #5,     clear
        add.a   #11,    loop
clear   spl     -5,     >gate-1 ; ok spl
        mov     bmb,    >gate
        mov     bmb,    >gate
loop    jmp     @-10,   >gate-1 ; ok jmp
        dat     0,      -2
bmb     dat     -2,     2-gate
        end
