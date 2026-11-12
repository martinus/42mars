;redcode-nano
;name song of the skylark
;author simon wainwright
;strategy oneshot
;assert CORESIZE==80

          scanstep      equ                   6
          scanfirst     equ          scanptr+13

scanloop  add.a   #scanstep,         @scanptr-1
          jmz.a    scanloop,           {scanptr
scanptr   mov.i  #scanfirst,           <scanptr
clear     mov        >clear,         }scanptr-1
          djn.a           0,                 *0

          end    scanloop+1
