;redcode-tiny
;name The Black Knight Returns
;author Christian Schmidt
;strategy stone/imp
;assert CORESIZE==800

         mov    <270,         245
         mov    <220,         195
         mov    <170,         145
         mov    <120,         100

         sPos   equ (xRef-216)
         iPos   equ (sPos+(57)*10)

xRef     mov    cBomb,        sPos+dStep+1
         spl    1,            {70
         spl    1,            }45
         mov    {dStart,      {sBoot
         mov    {paper,       {iBoot
sBoot    spl    sPos+4,       <-65
iBoot    djn.f  iPos+4,       <-90

         dStep  equ -83
         time   equ 346

dStart   spl    #0+4,         <467
stone    mov    dStep,        1+dStep*time
         sub.ab <0,           >0
         djn.f  stone,        <dStart+467

cBomb    dat    >-1,          >1

         istep  equ 267

paper    spl    @0+4,         istep+1
         mov    }paper,       >paper
         spl    >0,           >istep*2
imp      mov.i  #3,           istep

         end

