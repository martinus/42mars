;redcode-tiny 
;name Something to try 
;author G.Labarga 
;url http://labarga.atspace.com/ 
;assert CORESIZE==800 
;strategy two-shot 

sstep equ (7*10)    ;u see i didn't lose time on this. xD 
gate equ scan 

d1 equ (2*sstep+3) 
d2 equ d1-10 

org scan 

bref:        mov.b scan,<1      ;sets pointer and changes next b-field 
        mov sbm,>0         ;after change, next time it will start the clear 
loo:        add.f inc,scan 
scan:        sne d1,d2 
        djn.f loo,<384     ;decrement does not trigger the scanner 
        jmz.b bref,{-1     ;jump to set the pointer and adjusts the loop 
inc:        spl #2*sstep,2*sstep   ;very common clear 
        mov @cr,>gate 
        mov @cr,>gate 
cr:        djn.f -2,{sbm 
        dat -20,1-gate 
sbm:        spl #-180,5-gate 
end 

