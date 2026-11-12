;redcode-nano
;name Dark Servant
;author John Metcalf
;strategy imp
;assert CORESIZE==80

        istep  equ 27

        spl    #66,      <37
        spl    istep+1,  >42
        mov    -1,       istep
        mov.i  #7,       }istep
        mov.i  #15,      istep
