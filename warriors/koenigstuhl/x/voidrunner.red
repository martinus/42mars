;redcode-94x
;name Void Runner
;author John Metcalf
;strategy stone/imp
;assert CORESIZE==55440

        iboot  equ idest2+27720

warr    spl    1,          <500
        spl    1,          <1500
        mov    <isrc,      {idest1
        mov    <imp+1,     {idest2
        mov    {imp+1,     {idest3
        spl    1,          <2500
        mov    {ssrc,      {sdest
        spl    1,          <3500
        spl    1,          <4500
sdest   spl    25256,      <5500
idest2  spl    iboot,      <6500
idest3  spl    iboot+18480,<7500
idest1  djn.f  iboot-18480,<29000

        step   equ 8807
        time   equ 12696
        first  equ (last+step*time)

ssrc    spl    #8,         0
        spl    #0,         0
stone   mov    sbmb,       @ptr
last    sub.x  #step*2,    @stone
ptr     mov    {13376,     }first
        djn.f  @last,      }ptr

        dat    0,0

sbmb    dat    }step,      >1

        istep  equ 32191

isrc    spl    #0,         4
        add.f  #istep,     launch
launch  djn.f  imp-istep*32,<3455

imp     mov.i  #istep,     *0

end

