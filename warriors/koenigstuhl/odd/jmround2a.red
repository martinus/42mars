;redcode-?
;name Wildcat
;author John Metcalf
;strategy paper/clear
;       CORESIZE==160
;assert 1

        pstep equ 96

paper   spl    #0,     >-11
        mov    }paper, }dest
dest    spl    <pstep, >40
clear   mov    *10,    <paper-4
        mov    *4,     <paper-4
        djn.f  clear,  <90

        end
