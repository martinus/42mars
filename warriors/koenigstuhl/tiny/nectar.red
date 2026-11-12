;redcode-tiny 
;name Nectar
;author John Metcalf 
;strategy quickbomb -> oneshot 
;assert CORESIZE==800 

        step   equ 25 
        first  equ (gate+step*2) 
        gap    equ 19 
        inc    equ dptr 

scan    add    inc,        gate 
gate    sne    first+gap,  }first 
        djn.f  scan,       {338 

bptr    div.ab #1,         #9 
dptr    spl    #step,      step 
clear   mov    *bptr,      >gate 
        mov    *bptr,      >gate 
        djn.f  clear,      }dptr 

        dat    0,0 

qb a    for    10 
        mov    {first+156+50*a, first+212+50*a 
        rof 
        djn.f  gate,       {first+403 

        end    qb 

