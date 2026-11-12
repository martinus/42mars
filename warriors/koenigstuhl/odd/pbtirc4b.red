;redcode
;name PBT IRC4-B
;strategy Mini IRC Tournament 4
;assert 1

NME     EQU     (d1-10)

P1      EQU     -4

d1:     dat     1,          1
start:  spl     next,       >NME+6
        spl     1,          >NME+8
        spl     @0,         >P1
        mov.i   {-1,        <-1
bmb:    dat     <-2,        <+2
next:   mov.i   bmb,        >ptr
        djn.f   -1,         >ptr
        jmp     -1,         >4
ptr:    dat     >5,         >1

    end start