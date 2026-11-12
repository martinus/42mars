;redcode-94 test
;name Spray paper
;author Steve Gunnell
;assert 1

STEP1   equ  6322
STEP2   equ  2094
STEP3   equ  4573

ptr   dat     0        ,6004
      dat.f   0        ,0
      dat.f   0        ,0
      dat.f   0        ,0
hclr  spl     #0       ,0
for 0
      spl     #0       ,0
rof
for 0
      spl     #0       ,>ptr
rof
trash mov.i   dbmb     ,>ptr
for 0
      mov.i   dbmb     ,>ptr
rof
      djn.f   trash    ,>ptr
dbmb  dat.f   >2667    ,dbmb-ptr+4

for 50
dat.f 0,0
rof

;;;;;;;;;;;;;;;;;;;;
;                  ;
;    paper         ;
;                  ;
;;;;;;;;;;;;;;;;;;;;

paper  spl    1,         <paper-297
       spl    1,         <paper-298
       spl    1,         <paper-299
       spl    hclr      ,<paper-300
       spl    tpap+5334-STEP1*3 ,tpap
       mov    >-1       ,}-1
       spl    tpap+2667-STEP1*1 ,tpap
       mov    >-1       ,}-1
tpap   spl    @0        ,STEP1
       mov    }-1,       >-1
       spl    @0        ,STEP2
       mov    }-1,       >-1
hpap   spl    @0        ,STEP3
       mov    }-1,       >-1
       mov.i  bpap      ,>2522
bpap   dat <2667, <5334

end paper

