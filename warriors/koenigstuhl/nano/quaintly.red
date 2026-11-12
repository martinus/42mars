;redcode-nano
;name quaintly ineffective
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

    step  equ (-5)
    first equ ptr+step

ptr: add   #step,    #first
wipe:jmz.f ptr,      @ptr
     mov   bomb,     >ptr
     djn.f wipe,     {ptr+24
bomb:mov.i #0,       {0
     end   wipe
