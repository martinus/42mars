;redcode-?
;name Sputnik-8
;author John Metcalf
;strategy paper with satellite
;assert CORESIZE==8000

;       step   equ 7*7*7*7-8 
;       dist   equ 6*6*6*6

const   mul.f  #7,       #6            ; step, dist
        mul.f  const,    const
        add.a  const,    paper
        add.ba const,    const
        add.f  const,    launch

sputnik spl    1,        satel         ; 4 parallel processes
        spl    1

        mov    >sputnik, >launch

paper   spl    -8                      ; step
        mov    >paper,   }paper
        mov    <launch,  {launch
launch  djn.f  -8,       {-4           ; step+dist, dist-4

satel   spl    #-4,      <2
        mov.i  #1,       <1
        djn    satel,    #-8

