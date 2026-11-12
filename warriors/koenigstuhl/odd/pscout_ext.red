;redcode-94
;name pScout (extended)
;author David Moore / Fizmo
;assert 1
;strategy use a vampire to find opponent's pspace location

pVamp  equ    7      ;value for opponents actual strategy
pVamp2 equ    6      ;value of opponents used p-space - 1
;                                                     ^^^^
step   equ    1445   ; multiple of 5

fang   jmp    t1-(5+step), 5+step
vamp   mov    @0,          @fang
       add    t1,          fang
       jmz.a  vamp,        t2
       jmz.b  #0,          t2
       stp.b  t2,          #pVamp
       stp.ab t2,          #pVamp2

       for    4
       dat    0,           0
       rof

t1     spl    #-step,      #step
t2     ldp.ab #0,          #0
t3     dat    {0,          0

end vamp

