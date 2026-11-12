;redcode-tiny
;author inversed
;name Microcosmos
;strategy qbomb -> paper with satellite
;assert CORESIZE == 800

step    equ     104
dist    equ     41
orbit   equ     step + dist
len     equ     4

a0      equ     672
b0      equ     511
b1      equ     117
a2      equ     4
b2      equ     794

qa      equ     771
qb      equ     776
qc      equ     571
qd      equ     137
qba     equ     x0 + qa + i * qb
qbb     equ     x0 + qc + i * qd
qbb2    equ     x0 + qa + (blen + 1) * qb
blen    equ     9

x0      equ     (-CURLINE)
org     sat + len
        
sat     spl     # a0    ,   < b0     
        mov     } 0     ,   > b1      
        mov     > a2    ,   { b2     
        djn.f    -2     ,   <-3      

    i for blen
        mov     { qba   ,     qbb
    rof

boost   spl      1      ,     sat
        spl      1      ,   { qbb2
        mov    > boost  ,   > launch

silk    spl    @ 0      ,   { step
        mov    } silk   ,   > silk
        mov    < launch ,   { launch
launch  djn.f    orbit  ,   { dist - len

