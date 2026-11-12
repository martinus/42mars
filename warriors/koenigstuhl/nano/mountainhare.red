;redcode-nano
;name path of the mountain hare
;author John Metcalf
;strategy imp spiral
;assert CORESIZE==80

     istep   equ 27

loop:spl   imp+2*istep, >-18
     spl   imp+4*istep, >-32
star:spl   loop,        >15
     spl   imp+istep,   >39

imp: mov.i #9,          istep

     end   star

