;redcode-nano
;name Nano Zooom...
;author John Metcalf
;strategy scanner
;assert CORESIZE==80

     step  equ -6
     first equ ptr-17

adj: mov.b ptr,      atk
     mov   *70,      <atk+1
ptr: add   #step,    #first
     jmz.f ptr,      @ptr
atk: djn.f adj,      {-1
     end   ptr+1
