;redcode
;name FERRET
;author Robert Reed III
;assert 1
;
;       2ND ICWS COMPETITION ENTRY
;
;       FERRET
;
;       PROGRAMMER :  Robert Reed III, Windsor Locks, CN
;
START  MOV  #4908,B
F      CMP  <A,<B
       MOV  S,@B
       CMP  <A,<B
A      MOV  S,-5
       DJN  F,B
K      MOV  W,<W
       DJN  K,<W
       ADD  #3,W
B      JMP  K,0
W      DAT  #0,#-10
S      SPL  0,0

       END  START
