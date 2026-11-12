;redcode-tiny
;name Creeping Horror
;author John Metcalf
;strategy stone/imp
;kill Creeping Horror
;assert 1 || CORESIZE==800

        step   equ 195
        istep  equ 267
        idist  equ imp+589

        org    launch

inc     spl    #-step,     <step
stone   mov    >-step*2,   1+step*2
        add    inc,        stone
        djn.f  stone,      {401

        dat    0,          0
        dat    0,          0

        dat    400,        -9

        dat    0,          0
        dat    0,          0
        dat    0,          0
        dat    0,          0
        dat    0,          0

launch  spl    stone-1,    {-250
vect    mov    imp,        idist
        spl    1,          {idist+istep*6
        spl    1,          {idist+istep*4
        spl    2,          {idist+istep*2
        djn.a  >0,         #idist
        djn.f  @0,         #idist+istep*1

imp     mov.i  #-10,       istep

        end

