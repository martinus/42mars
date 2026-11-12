;redcode-94x
;name Clearmore
;author Lukasz Adamowski
;strategy clear
;assert 1

bmb     equ     trg

trg     dat     $0,     $0
        dat     $0,     $0
        dat     $0,     $0
        dat     $4,     $-3
start   mov     $3,     6
        add     $-2,    5
        add.a   #5,     $1
        spl     $-5,    <trg
        mov     $bmb,   <trg
        mov     $bmb,   <trg

        end     start


