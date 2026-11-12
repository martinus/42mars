;redcode-tiny
;name Resinoid
;author John Metcalf
;strategy dual resin with silk-launched imps
;assert CORESIZE==800

        mov    {100,     760
        mov    {220,     410
        mov    <780,     360
        mov    <480,     460

        bpos   equ resin+700

        spl    1,        <192
        spl    1,        >419

        mov    {resin,   {cboot1
        mov    {resin+4, {cboot2
        mov    {paper,   {pboot

cboot1  spl    bpos+400, }386
cboot2  spl    bpos,     {399
pboot   jmz.f  *193,     >249

; silk-launched imps

        istep  equ 267

paper   spl    @0+4,    istep+1
        mov    }paper,  >paper
        spl    >0,      }istep*2
imp     mov.i  #-1,     istep

; clear inspired by GT

resin   spl    0+4,      {resin-4
clear   mov    1,        <1
        mov    <0,       <345
        djn.f  clear,    {resin-4

        end

