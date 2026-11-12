;redcode-94
;Wilkies 129
;name Frantic Thistledown
;author Dave Hillis
;strategy - evolved imps from rdrc: Hesitant Astrology
;strategy - plus the quick scanner from nPaper II by Paul-V Khuong
;assert 1
spl.b  #  267, $    0
spl.x  #    -4, }  -373
spl.x  #    9, }    4
mov.i  #  267, }    3
mov.i  # -2988, }    2
mov.i  #  2302, }    1
jmp.f  $    21, {  340

DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 

DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
DAT.F  $ 0, $ 0 
CMP.I  $ 358, $ 251 
JMP.B  $ 33, { 364 
CMP.I  $ 1426, $ 1319 
JMP.B  $ 30, { 1432 
CMP.I  $ 1210, $ 1103 
JMP.B  $ 28, < 36 
CMP.I  $ 1636, $ 1529 
JMP.B  $ 26, > 34 
CMP.I  $ 2062, $ 1955 
DJN.B  $ 24, { 24 
CMP.I  $ 2274, $ 2167 
JMP.B  $ 22, { 22 
CMP.I  $ 774, $ 667 
JMP.B  > 20, { 780 
CMP.I  $ 558, $ 451 
JMP.B  > 18, { 17 
CMP.I  $ 984, $ 877 
JMP.B  > 16, } 15 
CMP.I  $ 2694, $ 2587 
JMP.B  $ 13, { 13 
CMP.I  $ 3334, $ 3227 
JMP.B  $ 11, < 20 
CMP.I  $ 4616, $ 4509 
JMP.B  $ 9, > 18 
CMP.I  $ 5256, $ 5149 
JMP.B  $ 7, } 7 
CMP.I  $ 5896, $ 5789 
DJN.B  $ 5, { 6 
CMP.I  $ 6536, $ 6429 
JMP.B  $ 3, { 4 
SNE.I  $ 3966, $ 3859 
JMZ.F  $ 7911, $ 3955 
MUL.AB # 3, $ 5 
MUL.B  $ 8, @ 7999 
SNE.I  > 3456, @ 3 
ADD.AB # 107, $ 2 
MOV.I  $ 5, @ 1 
MOV.I  $ 4, * 214 
SUB.AB # 7, $ 7999 
DJN.B  $ 7997, # 11 
JMP.B  $ 7902, > 10 
DAT.F  { 67, { 6 
end 58

