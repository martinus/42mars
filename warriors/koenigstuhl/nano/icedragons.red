;redcode-nano
;name legend of the ice dragons
;author John Metcalf
;strategy imp spirals
;assert CORESIZE==80

     istep equ 27

     spl   #imp+istep*2, >19
     mov   }imp,         {-1
     spl   imp-istep,    >-34
     spl   imp+istep,    >39
imp: mov.i #-1,          istep

     end
