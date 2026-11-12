;redcode
;name Pure Elemental Dust
;author John Metcalf
;strategy vampire
;assert 1

        step equ (3444)
        boot equ (2439)

vdest   mov vampire+3,vampire+boot+3
        mov vampire+2,<vdest
        mov vampire+1,<vdest
        mov vampire,  <vdest
        mov fang,     fang+boot
        mov inc,      inc+boot
tdest   mov trap+3,   trap+boot+3
        mov trap+2,   <tdest
        mov trap+1,   <tdest
        mov trap,     <tdest
        jmp vampire+boot,<1000

vampire spl 0,        <2-fang
vloop   mov fang,     @fang
        add inc,      fang
        djn vloop,    <3750

        for 12
        dat #trap,    #1
        rof

fang    jmp trap-vloop-step, <vloop-fang+step

        for 10
        dat #trap,    #1
        rof

trap    mov bomb,     <vampire-27
        spl -1
        jmp @-1
bomb    dat <2667,    <-trap+vampire+fang

        for 9
        dat #trap,    #1
        rof

inc     dat <-step,   <step

        for MAXLENGTH-CURLINE
        dat #trap,    #1
        rof

