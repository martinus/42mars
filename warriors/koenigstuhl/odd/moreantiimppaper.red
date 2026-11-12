;redcode
;name More Anti-Imp Paper?
;author Roy van Rijn
;assert 1

bStep1  equ     4221
bStep2  equ     7018
bStep3  equ     7658
bStep4  equ     1314
bStep5  equ     2959

cStep1  equ     4249
cStep2  equ     2427
cStep3  equ     4061

pGo     spl     2       , >1256
        spl     2       , >2566
        spl     1       , >2723
        spl     1       , 0

pAw1    equ     5614
pAw2    equ     3123

        mov     {cp     , {pBo1
pBo1    spl     pEnd+pAw1,{431

        mov     {pEnd   , {pBo2
pBo2    jmp     pEnd+pAw2,{444

cp      spl     @pEnd   , <cStep1
        mov.i   }cp     , >cp
nothA   spl     @nothA  , <cStep2
        mov.i   }nothA  , >nothA
        mov.i   #1      , <1
        mov.i   <bStep1 , {bStep2
        mov.i   {nothA  , {nothB
nothB   spl     cStep3  , >bStep3
        mov.i   #1      , {1
        mov.i   bStep4  , <bStep5
pEnd    dat     0       , 0

end pGo
