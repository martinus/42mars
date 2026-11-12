;redcode
;name Pepper by Sith by Ston
;author Zul Nadzri
;assert 1
;strategy Not so sure if the absence of imp will give any big impact
;strategy So, I merged 2by4k and Hullabaloo with prehistoric p_switch
;strategy May be should be a scanner inside too?

       ORG      START
       DAT.F  >  -888, >  1800     ;hullabaloo
       MOV.I  $    25, $  2592
       SPL.B  }     2, }  1800
       SPL.B  $     1, }  1800
       SPL.B  $     0, }  1800
       MOV.I  <    15, {     1
       SPL.B  $  -632, <  1719
       MOV.I  {    28, {     2
       SPL.B  *    -2, <  -899
       DJN.F  $  -496, <   821
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $   -18, $  1800
       DAT.F  $   -19, $  1800
       DAT.F  $     0, $     0
       SPL.B  #     0, $     6
       MOV.I  $  3224, @     2
       ADD.AB # -1012, $     1
       MOV.I  $  3222, } -3495
       DJN.F  $    -3, { -1616
       DAT.F  $     0, $     0
       DAT.F  }  3494, >     1
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       SPL.B  $ -2427, {     3
       MOV.I  }     2, }    -1
       MOV.I  $     3, >     1
       MOV.I  $     3, }    -3
       JMZ.F  $    -4, *    -1
       DAT.F  < -2666, <  2667
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       SPL.B  $    18, >  2323     ;2by4k
       SPL.B  $    29, >  3470
       SPL.B  $     1, > -3383
       MOV.I  $    -1, #     0
       SPL.B  $     1, > -2236
       MOV.I  <    17, {    17
       SPL.B  @     0, >     1
       MOV.I  }    -1, >    -1
       MOV.I  {    -2, <     1
       SPL.B  @     0, > -1460
       MOV.I  # -2685, } -1809
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       SPL.B  $     1, > -1089
       MOV.I  $    11, #     0
       SPL.B  $     1, >    58
       MOV.I  <    12, {    12
       JMP.B  $  -992, $   -10
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       DAT.F  $     0, $     0
       SPL.B  $     1, >  1205
       MOV.I  $   -13, #     0
       SPL.B  $     1, >  2352
       JMP.B  $  3488, $   -21
       DAT.F  $     0, $     0
START  LDP.AB #     0, #     0     ;first generation pswitch
       LDP.A  $    99, $     5
       SNE.AB #     0, $    -2
       ADD.A  #     1, $     3
       MOD.A  #     2, $     2
       STP.AB $     1, $    99
       JMP.B  @     0, $   -41
       DAT.F  $     0, $   -83

end

