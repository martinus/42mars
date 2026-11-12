;redcode-tiny
;name Peridot
;author John Metcalf
;strategy stone/imp
;assert CORESIZE==800

        istep  equ 267
        idist  equ imp+595

        org    launch

        hop    equ 18
        step   equ 433
        time   equ 145

        spl    #0,         0
stone   mov    db,         >hit+step*time-hop
hit     mov    *-1,        @stone
        sub    #step,      @hit
        djn.f  stone,      <-350

        dat    0,          0
        dat    0,          0
        dat    0,          0

db      dat    <1,          <hop

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

