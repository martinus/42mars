;redcode
;name Last change... :-O
;author Roy van Rijn
;assert 1

bStep1  equ     6025
bStep2  equ     507
bStep3  equ     2086
bStep4  equ     3636
bStep5  equ     1252

cStep1  equ     7370
cStep2  equ     3798
cStep3  equ     6519

pGo     spl     2       , {356
t2      spl     2       , {7453
        spl     1       , {5232
        spl     1       , {5232

pAw1    equ     2039
pAw2    equ     921

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
        mov.i   #1      , <1
        mov.i   <bStep4 , {bStep5
        mov.i   {nothA  , {nothB
nothB   djn.f   cStep3  , >bStep3
pEnd    dat     0       , 0
end pGo
