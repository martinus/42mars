;redcode-tiny
;name Sputnik
;author John Metcalf
;strategy decoy maker -> paper with satellite
;assert CORESIZE==800

        org decoy

        step   equ 188
        dist   equ 128
        bpos   equ satel+4-dist+1

sputnik spl    1,        satel    ; 4 parallel processes
        spl    1,        <400

        mov    >sputnik, >launch

paper   spl    step
        mov    >paper,   }paper
        mov    <launch,  {launch
launch  djn.f  step+dist,{dist-4

satel   spl    #743,     <2
        mov.i  #1,       <1
        djn    satel,    #547

        for    3
        dat    0,0
        rof

        dpos   equ decoy+604

decoy   mov    >dpos+1,    {dpos+22
        mov    <dpos+23,   {dpos+43
        mov    <dpos+44,   {dpos+64
        mov    <dpos+65,   {dpos+85
        mov    <dpos+86,   {dpos+107
        mov    <dpos+108,  {dpos+128
        djn.f  sputnik,    <dpos+149

